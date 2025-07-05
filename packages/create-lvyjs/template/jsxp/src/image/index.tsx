import { ObtainProps, renderComponentToBuffer } from 'jsxp'
import Help from '@src/image/conponent/help'
/**
 *
 * @param Props
 * @returns
 */
export const Picture = (Props: ObtainProps<typeof Help>) => {
  return renderComponentToBuffer('/help', Help, {
    data: Props.data
  })
}
