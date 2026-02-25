/* eslint-env worker */

import astToDictModule from './ast_to_dict.py.txt';

const PYODIDE_VERSION = '0.28.3';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

let pyodidePromise = null;

function proxyToJs(proxy) {
  if (!proxy || typeof proxy.toJs !== 'function') {
    return proxy;
  }
  return proxy.toJs({
    dict_converter: entries => Object.fromEntries(entries),
    create_proxies: false,
  });
}

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (typeof self.loadPyodide !== 'function') {
        importScripts(PYODIDE_SCRIPT_URL);
      }
      const pyodide = await self.loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
      });
      pyodide.runPython(astToDictModule);
      return pyodide;
    })();
  }
  return pyodidePromise;
}

const handlers = {
  async parse(code) {
    const pyodide = await getPyodide();

    pyodide.globals.set('__astexplorer_python_code__', code);
    let resultProxy;
    try {
      pyodide.runPython('__astexplorer_python_result__ = parse_to_dict(__astexplorer_python_code__)');
      resultProxy = pyodide.globals.get('__astexplorer_python_result__');
      const result = proxyToJs(resultProxy);
      if (!result.success) {
        const info = result.error || {};
        const error = new SyntaxError(info.display || info.message || 'Python parse failed.');
        error.name = info.type || 'SyntaxError';
        error.lineNumber = info.lineno;
        error.columnNumber = info.offset;
        error.endLineNumber = info.end_lineno;
        error.endColumnNumber = info.end_offset;
        error.sourceLine = info.text;
        throw error;
      }
      return result.ast;
    } finally {
      pyodide.globals.delete('__astexplorer_python_code__');
      pyodide.globals.delete('__astexplorer_python_result__');
      if (resultProxy && typeof resultProxy.destroy === 'function') {
        resultProxy.destroy();
      }
    }
  },
};

onmessage = async function(e) {
  const {type, requestId, args = []} = e.data;
  let handler = () => {
    throw new Error('No handler in Pyodide worker for message type: ' + type);
  };
  if (Object.hasOwnProperty.call(handlers, type)) {
    handler = handlers[type];
  }
  let value;
  try {
    value = await handler(...args);
  } catch (error) {
    postMessage({
      type,
      requestId,
      action: 'reject',
      value: {name: error.name, stack: error.stack, message: error.message, ...error},
    });
    return;
  }
  postMessage({type, requestId, action: 'resolve', value});
};
