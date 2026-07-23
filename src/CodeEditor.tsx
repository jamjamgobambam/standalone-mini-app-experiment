import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
// Grammar order matters: dependencies must load before dependents.
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';

import {FileLanguage} from './miniAppFiles';
import styles from './CodeEditor.module.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: FileLanguage;
}

const GRAMMARS: Record<string, {grammar: Prism.Grammar; name: string}> = {
  py: {grammar: Prism.languages.python, name: 'python'},
  ts: {grammar: Prism.languages.typescript, name: 'typescript'},
  tsx: {grammar: Prism.languages.tsx, name: 'tsx'},
  css: {grammar: Prism.languages.css, name: 'css'},
};

/**
 * Editable code area with Prism syntax highlighting.
 *
 * Wraps react-simple-code-editor (a transparent <textarea> layered over a
 * highlighted <pre>), so it keeps plain value/onChange semantics — the same
 * contract a <textarea> has, which the autosave logic relies on.
 */
export default function CodeEditor({
  value,
  onChange,
  language = 'py',
}: CodeEditorProps) {
  const {grammar, name} = GRAMMARS[language] ?? GRAMMARS.py;
  return (
    <div className={styles.wrap}>
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={code => Prism.highlight(code, grammar, name)}
        padding={14}
        textareaClassName={styles.textarea}
        preClassName={styles.pre}
        className={styles.editor}
        spellCheck={false}
      />
    </div>
  );
}
