/**
 * save-to-works.js
 * 把绘画作品直接保存到本地 works 文件夹。
 *
 * 原理: Chrome/Edge 的 File System Access API 允许网页在用户授权后
 * 直接向本地文件夹写文件。第一次保存时用户手动选择一次 works 文件夹,
 * 句柄存进 IndexedDB, 之后(含刷新/重开页面)无需再次选择, 仅首次需点一下授权。
 * 不支持该 API 的浏览器(Firefox/Safari 等)自动回退为普通下载。
 *
 * 用法:
 *   var result = await window.saveToWorks(dataURL, 'xxx.png');
 *   result: 'saved' | 'cancelled' | 'unsupported' | 'error'
 */
(function () {
  'use strict';

  var DB_NAME = 'lumina-stroke-gallery';
  var STORE = 'settings';
  var KEY = 'works-dir-handle';

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbSet(db, key, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function fsSupported() {
    return typeof window.showDirectoryPicker === 'function' &&
           'FileSystemFileHandle' in window;
  }

  /* 请求文件夹权限; 刷新页面后浏览器通常会要求重新确认一次 */
  async function ensurePermission(handle, mode) {
    var opts = { mode: mode || 'readwrite' };
    try {
      if ((await handle.queryPermission(opts)) === 'granted') return true;
      if ((await handle.requestPermission(opts)) === 'granted') return true;
    } catch (err) {
      /* 非用户手势下申请权限可能被浏览器拒绝, 交给页面按钮重试 */
    }
    return false;
  }

  async function ensureWritable(handle) {
    return ensurePermission(handle, 'readwrite');
  }

  function downloadFallback(dataURL, name) {
    var a = document.createElement('a');
    a.href = dataURL;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function dataURLtoBlob(dataURL) {
    var res = await fetch(dataURL);
    return await res.blob();
  }

  async function writeFile(dirHandle, dataURL, fileName) {
    var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    var writable = await fileHandle.createWritable();
    await writable.write(await dataURLtoBlob(dataURL));
    await writable.close();
  }

  async function pickWritableDir() {
    var db = await openDB();
    var dirHandle = await idbGet(db, KEY);
    if (dirHandle && (await ensureWritable(dirHandle))) return dirHandle;

    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (pickErr) {
      return null; // 用户点了取消
    }
    await idbSet(db, KEY, dirHandle);
    if (!(await ensureWritable(dirHandle))) return null;
    return dirHandle;
  }

  /* 批量保存: 一次授权后连续写入多个文件, 避免第二个文件脱离用户手势被拦截 */
  window.saveManyToWorks = async function (items) {
    if (!fsSupported() ||
        typeof FileSystemFileHandle.prototype.createWritable !== 'function') {
      items.forEach(function (it) { downloadFallback(it.dataURL, it.fileName); });
      return items.map(function () { return 'unsupported'; });
    }

    var dirHandle = await pickWritableDir();
    if (!dirHandle) return items.map(function () { return 'cancelled'; });

    var results = [];
    for (var i = 0; i < items.length; i++) {
      try {
        console.log('[saveMany] writing', items[i].fileName);
        await writeFile(dirHandle, items[i].dataURL, items[i].fileName);
        console.log('[saveMany] done', items[i].fileName);
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
    supported: fsSupported(),

    /* 获取已记住的 works 文件夹; autoPick=true 时没有记忆则弹选择器 */
    async getHandle(autoPick, mode) {
      if (!fsSupported()) return null;
      var db = await openDB();
      var handle = await idbGet(db, KEY);
      if (!handle) {
        if (!autoPick) return null;
        handle = await window.showDirectoryPicker({ mode: mode || 'read' });
        await idbSet(db, KEY, handle);
      }
      if (await ensurePermission(handle, mode || 'read')) return handle;
      return null;
    },

    /* 用户点击按钮时调用: 先申请已记忆文件夹权限, 不行则重新选择 */
    async connect() {
      if (!fsSupported()) return null;
      var db = await openDB();
      var handle = await idbGet(db, KEY);
      if (handle && (await ensurePermission(handle, 'read'))) return handle;

      handle = await window.showDirectoryPicker({ mode: 'read' });
      await idbSet(db, KEY, handle);
      if (await ensurePermission(handle, 'read')) return handle;
      return null;
    },

    /* 列出 works 文件夹中的图片, 按修改时间倒序 */
    async listImages() {
      var handle = await this.getHandle(false, 'read');
      if (!handle) return [];

      var files = [];
      for await (var entry of handle.values()) {
        if (entry.kind !== 'file') continue;
        var ext = (entry.name.split('.').pop() || '').toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(ext) === -1) continue;
        var file = await entry.getFile();
        files.push(file);
      }
      return files.sort(function (a, b) { return b.lastModified - a.lastModified; });
    },

    /* 删除 works 文件夹中的指定图片; 需 readwrite 权限, 须在用户点击手势内调用 */
    async deleteImage(fileName) {
      var handle = await this.getHandle(false, 'readwrite');
      if (!handle) return false;
      try {
        var fileHandle = await handle.getFileHandle(fileName);
        await fileHandle.remove();
        return true;
      } catch (err) {
        console.error('[worksStore] delete failed', fileName, err);
        return false;
      }
    }
  };
})();
