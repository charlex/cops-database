export const sleep = (sleepForSeconds: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, sleepForSeconds * 1000);
  });
