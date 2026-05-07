import React, { useState, useRef } from "react";
import "../styles/consultation.css";

function ImageCropper({ imageSrc, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    const size = 300;
    
    canvas.width = size;
    canvas.height = size;

    // Calculate crop area
    const scale = zoom;
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2 + crop.x;
    const sourceY = (image.naturalHeight - sourceSize) / 2 + crop.y;

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize / scale,
      sourceSize / scale,
      0,
      0,
      size,
      size
    );

    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCropComplete(reader.result);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="cropper-modal-overlay">
      <div className="cropper-modal">
        <div className="cropper-header">
          <h3>Adjust Profile Picture</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="cropper-body">
          <div className="cropper-container">
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              className="cropper-image"
              style={{
                transform: `scale(${zoom}) translate(${crop.x}px, ${crop.y}px)`
              }}
            />
          </div>

          <div className="cropper-controls">
            <label>Zoom</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="zoom-slider"
            />
          </div>
        </div>

        <div className="cropper-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleCrop}>
            Apply
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default ImageCropper;
