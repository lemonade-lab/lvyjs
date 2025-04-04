export const createFuncCode = (code: string) => {
  return `
    (() => {
        ${code}  
        return css;  
    })()
`
}
