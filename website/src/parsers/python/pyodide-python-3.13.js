import defaultParserInterface from '../utils/defaultParserInterface';
import PyodidePythonWorkerClient from './pyodide-worker/PyodidePythonWorkerClient';

const ID = 'pyodide-python-3.13';
const DISPLAY_NAME = 'pyodide (Python 3.13)';

export default {
  ...defaultParserInterface,

  id: ID,
  displayName: DISPLAY_NAME,
  version: 'Pyodide runtime (Python 3.13)',
  homepage: 'https://pyodide.org/',

  typeProps: new Set(['_type']),
  locationProps: new Set(['lineno', 'col_offset', 'end_lineno', 'end_col_offset']),

  loadParser(callback) {
    callback(new PyodidePythonWorkerClient());
  },

  async parse(pyodideParser, code) {
    this.lineOffsets = [];
    let index = 0;
    do {
      this.lineOffsets.push(index);
    } while (index = code.indexOf('\n', index) + 1); // eslint-disable-line no-cond-assign

    return await pyodideParser.parse(code);
  },

  getOffset({line, column}) {
    if (!Number.isInteger(line) || line < 1) {
      return null;
    }
    const lineOffset = this.lineOffsets[line - 1];
    if (!Number.isInteger(lineOffset)) {
      return null;
    }
    return lineOffset + (column || 0);
  },

  nodeToRange(node) {
    if (!(node && typeof node === 'object')) {
      return null;
    }

    const {
      lineno,
      col_offset: colOffset,
      end_lineno: endLine,
      end_col_offset: endColOffset,
    } = node;

    if (!Number.isInteger(lineno) || !Number.isInteger(colOffset)) {
      return null;
    }

    const start = this.getOffset({line: lineno, column: colOffset});
    let end = null;

    if (Number.isInteger(endLine) && Number.isInteger(endColOffset)) {
      end = this.getOffset({line: endLine, column: endColOffset});
    }

    if (!Number.isInteger(start)) {
      return null;
    }

    if (!Number.isInteger(end)) {
      end = start;
    }

    return [start, end];
  },

  getNodeName(node) {
    return node && node._type;
  },

  opensByDefault(_node, key) {
    switch (key) {
      case 'body':
      case 'orelse':
      case 'finalbody':
      case 'handlers':
        return true;
    }
  },
};
