import { useCallback, useState } from 'react';
import { DropzoneOptions } from 'react-dropzone';
import FileDrop from './FileDrop';
import Result from './Result';

function extractAndShowTextFromXml(xmlNode: Element | ChildNode): string {
  if (xmlNode.nodeType === Node.TEXT_NODE) {
    // If it's a text, work with it
    const tempText = xmlNode.textContent?.trim() ?? '';
    if (tempText.length === 0) {
      // If it's an empty text, skip this branch
      return '';
    }
    // Otherwise show it
    return `${tempText}\n`;
  }
  // Otherwise go deeper in the tree
  let text = '';
  for (let j = 0; j < xmlNode.childNodes.length; j++) {
    text += extractAndShowTextFromXml(xmlNode.childNodes[j]);
  }
  return text;
}

function Upload() {
  const [result, setResult] = useState('');

  const onDrop: Exclude<DropzoneOptions['onDrop'], undefined> = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      // Get the file
      const reader = new FileReader();

      // Once it's loaded, do something
      reader.onabort = () => console.log('File reading was aborted');
      reader.onerror = () => console.log('File reading has failed');
      reader.onload = () => {
        // Parse the xml into an object
        const readXml = reader.result;
        if (typeof readXml !== 'string') {
          return;
        }
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(readXml, 'application/xml');

        // Find all the elements which contain the text we want
        const textNodes = xmlDoc.getElementsByTagName('textContent');

        // Clear the result (for when we use it multiple times
        setResult('');

        // Extract the text out of it
        let tempResult = '';
        for (let i = 0; i < textNodes.length; i++) {
          tempResult += extractAndShowTextFromXml(textNodes[i]);
        }

        setResult(tempResult);
      };

      // Read the file
      reader.readAsText(file);
    });
  }, [setResult]);

  return (
    <>
      <FileDrop onDrop={onDrop} />
      <Result result={result} />
    </>
  );
}

export default Upload;
