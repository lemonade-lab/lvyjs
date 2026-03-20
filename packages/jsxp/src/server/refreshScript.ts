export const createRefreshScript = (key: number) => {
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
            s.src = '/check-for-changes?key=${key}&callback=__jsxp_cb';
            s.onload = s.onerror = () => s.remove();
            document.body.appendChild(s);
          };
          setInterval(checkForChanges, 1600);
        })();
      </script>
    `
}
