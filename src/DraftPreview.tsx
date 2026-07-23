import React, {useImperativeHandle} from 'react';

import {MiniAppPreviewHandle} from './miniAppRegistry';
import styles from './App.module.css';

/**
 * Placeholder preview shown for an unsaved draft mini-app. A real preview
 * needs its compiled component on disk, which only exists after the first
 * Save — so until then this explains that.
 */
const DraftPreview = React.forwardRef<MiniAppPreviewHandle>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    handleParsedSignal: () => {},
    reset: () => {},
    onRun: () => {},
    onClose: () => {},
  }));

  return (
    <div className={styles.draftPreview}>
      <p className={styles.draftPreviewTitle}>New mini-app (unsaved)</p>
      <p className={styles.draftPreviewHint}>
        Save this mini-app to generate its files on disk and enable the live
        preview.
      </p>
    </div>
  );
});

DraftPreview.displayName = 'DraftPreview';

export default DraftPreview;
