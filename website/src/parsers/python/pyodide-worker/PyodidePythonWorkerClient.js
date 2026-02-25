// Some ESLint rules don't understand the Webpack loader syntax.
// eslint-disable-next-line require-in-package/require-in-package, import/default
import PyodidePythonWorker from 'worker-loader!./pyodide-python-worker.js';

// A Promise-based client for making requests to pyodide-python-worker.js.
export default class PyodidePythonWorkerClient {
  constructor() {
    this._nextRequestId = 0;
    this._requests = new Map();
    this._worker = new PyodidePythonWorker();
    this._worker.onmessage = this._handleMessage.bind(this);
  }

  _handleMessage(e) {
    const {type, action, value, requestId} = e.data;
    const request = this._requests.get(requestId);
    if (!request) {
      throw new Error(
        `Received a response for a nonexistent '${type}' request ID: ${requestId}`,
      );
    }
    this._requests.delete(requestId);
    switch (action) {
      case 'resolve':
        request.resolve(value);
        break;
      case 'reject':
        // The worker sends errors as plain objects to work around the
        // limitations of the structured clone algorithm.
        request.reject(Object.assign(new Error(), value));
        break;
    }
  }

  _request(type, args) {
    return new Promise((resolve, reject) => {
      const requestId = this._nextRequestId++;
      this._requests.set(requestId, {resolve, reject});
      this._worker.postMessage({type, args, requestId});
    });
  }

  parse(...args) {
    return this._request('parse', args);
  }
}
