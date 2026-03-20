/**
 * 生成一个脚本，用于在页面上定期检查是否有更新
 * @param key 唯一标识，用于区分不同的刷新请求
 * @param prefix 可选的前缀，用于指定检查更新的路径
 * @returns 返回一个包含刷新逻辑的脚本字符串
 */
export const createRefreshScript = (key: number, prefix = '') => {
  return `
      <script>
        (function() {
          window.__jsxp_cb = function(data) {
            if (data.hasChanges) {
              location.reload();
            }
          };
          const checkForChanges = () => {
            const s = document.createElement('script');
            s.src = '${prefix}/check-for-changes?key=${key}&callback=__jsxp_cb';
            s.onload = s.onerror = () => s.remove();
            document.body.appendChild(s);
          };
          setInterval(checkForChanges, 1600);
        })();
      </script>
    `
}
