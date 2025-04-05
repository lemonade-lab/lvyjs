export const createRefreshScript = (key: number) => {
  return `
      <script>
        (function() {
          const checkForChanges = () => {
            fetch('/check-for-changes?key=${key}')  
              .then(response => response.json())
              .then(data => {
                if (data.hasChanges) {
                  // 如果接口返回了变化，则刷新页面
                  location.reload();
                }
              })
              .catch(err => console.error('jsxp 未响应:', err));
          };
    
          // 初次加载后每 1600 发送请求检查变化
          setInterval(checkForChanges, 1600);
        })();
      </script>
    `
}
