import React from 'react';
import ResizePanel from 'react-resize-panel';

const EmbeddedContent = ({ url }) => {
  return (
    <ResizePanel
      direction="s"
      style={{ minHeight: '16rem' }}
      handleClass="resize-handle"
    >
      <iframe 
        src={url} 
        className="w-full h-full" 
        frameBorder="0" 
        allowFullScreen
      ></iframe>
    </ResizePanel>
  );
};

export default EmbeddedContent; 