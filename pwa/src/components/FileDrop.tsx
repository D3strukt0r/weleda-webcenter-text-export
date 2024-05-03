import Dropzone, { DropzoneOptions } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

function FileDrop({ onDrop }: { onDrop?: DropzoneOptions['onDrop'] }) {
  const { t } = useTranslation('app');
  return (
    <Dropzone onDrop={onDrop}>
      {({ getRootProps, getInputProps }) => (
        <section>
          <div {...getRootProps()} className="bg-gray-100 w-full h-96 m-0 mb-2.5 text-center flex flex-col justify-center items-center">
            <FontAwesomeIcon icon={faUpload} className="h-12 w-12 mb-4" />
            <input {...getInputProps()} />
            <p>{t('upload.clickOrDrag')}</p>
          </div>
        </section>
      )}
    </Dropzone>
  );
}

export default FileDrop;
