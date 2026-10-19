/**
 * save-to-works.js
 * 把绘画作品保存到浏览器的 IndexedDB, 画展页从同一处读取展示。
 *
 * 说明:
 *   数据保存在当前浏览器(按站点隔离)中, 刷新/重开页面都不会丢失,
 *   但不跨设备、不跨浏览器, 清理浏览器数据时会被清除。
 *   三个绘画页与 gallery.html 只通过下面几个方法交互:
 *     window.saveToWorks(dataURL, fileName)
 *     window.saveManyToWorks([{dataURL, fileName}, ...])
 *     window.worksStore.listImages()  -> File[] (按修改时间倒序)
 *     window.worksStore.deleteImage(fileName)
 */
(function () {
  'use strict';

  var DB_NAME = 'lumina-stroke-gallery';
  var SETTINGS_STORE = 'settings';
  var WORKS_STORE = 'works';
  var DB_VERSION = 2;

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
        if (!db.objectStoreNames.contains(WORKS_STORE)) {
          db.createObjectStore(WORKS_STORE, { keyPath: 'name' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function txGetAll(storeName) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function txPut(storeName, value, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        if (key !== undefined) store.put(value, key);
        else store.put(value);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function txDelete(storeName, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  async function dataURLtoBlob(dataURL) {
    var res = await fetch(dataURL);
    return await res.blob();
  }

  function downloadFallback(dataURL, name) {
    var a = document.createElement('a');
    a.href = dataURL;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function idbSupported() {
    return typeof indexedDB !== 'undefined';
  }

  /* 批量保存: 依次写入 IndexedDB, 文件名相同时覆盖 */
  window.saveManyToWorks = async function (items) {
    if (!idbSupported()) {
      items.forEach(function (it) { downloadFallback(it.dataURL, it.fileName); });
      return items.map(function () { return 'unsupported'; });
    }

    var results = [];
    for (var i = 0; i < items.length; i++) {
      try {
        var blob = await dataURLtoBlob(items[i].dataURL);
        await txPut(WORKS_STORE, {
          name: items[i].fileName,
          blob: blob,
          lastModified: Date.now()
        });
        results.push('saved');
      } catch (err) {
        console.error('[saveMany] failed', items[i].fileName, err);
        try { downloadFallback(items[i].dataURL, items[i].fileName); } catch (e2) {}
        results.push('error');
      }
    }
    return results;
  };

  window.saveToWorks = function (dataURL, fileName) {
    return window.saveManyToWorks([{ dataURL: dataURL, fileName: fileName }])
      .then(function (results) { return results[0]; });
  };

  window.worksStore = {
    supported: idbSupported(),

    /* 列出全部作品, 还原为 File[] (含 name/lastModified), 按修改时间倒序 */
    async listImages() {
      var records = await txGetAll(WORKS_STORE);
      return records
        .map(function (rec) {
          return new File([rec.blob], rec.name, {
            type: rec.blob.type || 'image/png',
            lastModified: rec.lastModified || 0
          });
        })
        .sort(function (a, b) { return b.lastModified - a.lastModified; });
    },

    /* 删除指定作品 */
    async deleteImage(fileName) {
      try {
        await txDelete(WORKS_STORE, fileName);
        return true;
      } catch (err) {
        console.error('[worksStore] delete failed', fileName, err);
        return false;
      }
    }
  };
})();
