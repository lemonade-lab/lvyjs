import '@src/tes.js'
import '@src/test'
import '@src/abc/index'
import '@src/my.js'
import json from '@src/assets/test.json'
import cssURL from '@src/assets/test.css'
import lesscssURL from '@src/assets/test.less'
import scssURL from '@src/assets/test.scss'
import sassURL from '@src/assets/test.sass'
import imageURL from '@src/assets/test.jpeg'
import { show } from '@src/test'
console.log('json', json)
console.log('css', cssURL)
console.log('less', lesscssURL)
console.log('scss', scssURL)
console.log('sass', sassURL)
console.log('sass', imageURL)

function main() {
  setInterval(async () => {
    // const { show } = await import('@src/test' + '?t=' + Date.now())
    show()
  }, 3000)
}
main()
