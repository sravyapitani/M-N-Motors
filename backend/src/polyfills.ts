// pdfjs-dist (RC Book OCR) calls Promise.withResolvers, which only exists from Node 22.
// Terminals using fnm/nvm may run Node 20, where RC Book extraction would fail with
// "Promise.withResolvers is not a function". Must be imported before anything else.
const PromiseCtor = Promise as PromiseConstructor & {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

if (typeof PromiseCtor.withResolvers !== 'function') {
  PromiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
