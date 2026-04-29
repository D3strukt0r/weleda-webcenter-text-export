import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import type {Route} from './+types/home';
import {AppFooter} from '~/components/AppFooter';
import {DragOverlay} from '~/components/DragOverlay';
import {Dropzone} from '~/components/Dropzone';
import {Lede} from '~/components/Lede';
import {Result} from '~/components/Result';
import {Toast} from '~/components/Toast';
import {Topbar} from '~/components/Topbar';
import {useConverter} from '~/hooks/useConverter';
import {usePageDragDrop} from '~/hooks/usePageDragDrop';
import {usePasteXml} from '~/hooks/usePasteXml';
import {useToast} from '~/hooks/useToast';
import {i18n} from '~/i18n';

export function meta(_: Route.MetaArgs) {
  return [
    {title: i18n.t('meta.page_title')},
    {name: 'description', content: i18n.t('meta.page_description')},
  ];
}

export default function Home() {
  const {t} = useTranslation();
  const {state, stats, hasResult, loadFile, clear} = useConverter();
  const {toast, showToast} = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      const result = await loadFile(file);
      if (!result.ok) {
        showToast(result.reason === 'not-xml' ? t('toast.not_xml') : t('toast.read_failed'), 'error');
        return;
      }
      if (!result.nonEmpty) {
        showToast(t('toast.no_content'), 'error');
      }
    },
    [loadFile, showToast, t],
  );

  const {active: dragActive} = usePageDragDrop(handleFile);

  const handleShortcutNotUsable = useCallback(() => {
    showToast(t('toast.not_xml'), 'error');
  }, [showToast, t]);
  usePasteXml(handleFile, t('paste.pasted_file_name'), handleShortcutNotUsable);

  const handleCopyFailed = useCallback(() => {
    showToast(t('toast.copy_failed'), 'error');
  }, [showToast, t]);

  return (
    <>
      <Topbar />
      <main className="page-main">
        <Lede />
        <Dropzone onFileChosen={handleFile} />
        <Result
          paragraphs={state.paragraphs}
          text={state.text}
          fileName={state.fileName}
          fileSize={state.fileSize}
          words={stats.words}
          chars={stats.chars}
          visible={hasResult}
          onClear={clear}
          onCopyFailed={handleCopyFailed}
        />
      </main>
      <AppFooter />
      <DragOverlay active={dragActive} />
      <Toast toast={toast} />
    </>
  );
}
