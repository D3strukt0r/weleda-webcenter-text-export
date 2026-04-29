import {useEffect, useRef, useState} from 'react';

function eventCarriesFiles(event: DragEvent): boolean {
  const dt = event.dataTransfer;
  if (!dt) {
    return false;
  }
  for (const t of dt.types) {
    if (t === 'Files') {
      return true;
    }
  }
  return false;
}

export function usePageDragDrop(onDrop: (file: File) => void) {
  const [active, setActive] = useState(false);
  const depthRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!eventCarriesFiles(e)) {
        return;
      }
      e.preventDefault();
      depthRef.current += 1;
      setActive(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!eventCarriesFiles(e)) {
        return;
      }
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!eventCarriesFiles(e)) {
        return;
      }
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setActive(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!eventCarriesFiles(e)) {
        return;
      }
      e.preventDefault();
      depthRef.current = 0;
      setActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        onDrop(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onDrop]);

  return {active};
}
