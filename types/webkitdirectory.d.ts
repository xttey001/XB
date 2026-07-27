// 扩展 HTMLInputElement 类型，支持 webkitdirectory 属性
// 该属性所有现代浏览器都支持，但不在 TypeScript 标准库中
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export {};
