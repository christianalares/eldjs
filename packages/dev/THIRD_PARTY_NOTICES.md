# Third-party notices

Eld includes code adapted from [TanStack Router](https://github.com/TanStack/router),
MIT licensed, at commit [`18154b1c45454a70aa77e9d6d27c8a6e0733d031`](https://github.com/TanStack/router/tree/18154b1c45454a70aa77e9d6d27c8a6e0733d031).

- `src/vendor/generator/` derives from `packages/router-generator/src/` (package version 1.167.44). Changes add an API target and Eld templates/imports/configuration, reject UI split files, expose watcher dependencies, use ESM import extensions, and define the root route ID locally instead of depending on router-core for that constant.
- The corresponding compiled files in `dist/vendor/` are covered by the same notice.

The upstream license follows. Eld is an independent project, not an official TanStack product.

MIT License

Copyright (c) 2021-present Tanner Linsley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
