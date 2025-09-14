class ImageToGifConverter {
    constructor() {
        this.originalImage = null;
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentSize = 128;

        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.originalImageEl = document.getElementById('originalImage');
        this.controls = document.getElementById('controls');
        this.sizeSlider = document.getElementById('sizeSlider');
        this.outputSizeDisplay = document.getElementById('outputSizeDisplay');
        this.previewContainer = document.getElementById('previewContainer');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newImageBtn = document.getElementById('newImageBtn');
    }

    setupEventListeners() {
        // File input
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        // Drag & Drop
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        
        // Paste functionality
        document.addEventListener('paste', this.handlePaste.bind(this));
        
        // Size slider
        this.sizeSlider.addEventListener('input', this.handleSizeChange.bind(this));
        
        // Download button
        this.downloadBtn.addEventListener('click', this.downloadGif.bind(this));
        
        // New image button
        this.newImageBtn.addEventListener('click', this.resetToUpload.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.handleFileSelect(files[0]);
        }
    }

    async handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await this.handleFileSelect(file);
                }
                break;
            }
        }
    }

    async handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        try {
            const img = await this.loadImage(file);
            this.originalImage = img;
            this.setupImagePreview();
            this.showControls();
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Error loading image. Please try again.');
        }
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }

    setupImagePreview() {
        const img = this.originalImage;

        // Set slider to default (128px)
        this.sizeSlider.value = 128;
        this.currentSize = 128;

        // Update canvas and preview
        this.updatePreview();

        // Update output size display
        this.updateOutputSize();
    }

    // Multi-pass bilinear scaling for optimal quality
    multiPassScale(sourceImg, targetWidth, targetHeight) {
        const sourceWidth = sourceImg.naturalWidth || sourceImg.width;
        const sourceHeight = sourceImg.naturalHeight || sourceImg.height;

        // Calculate scale factor
        const scaleX = targetWidth / sourceWidth;
        const scaleY = targetHeight / sourceHeight;
        const scale = Math.min(scaleX, scaleY);

        // If scaling down less than 0.5x, use multi-pass
        if (scale < 0.5) {
            const passes = [];
            let currentScale = scale;

            // Break down into 2x steps and remainder
            while (currentScale < 0.5) {
                passes.push(0.5);
                currentScale /= 0.5;
            }
            if (currentScale < 1.0) {
                passes.push(currentScale);
            }

            // Apply passes
            let currentImg = sourceImg;
            let tempCanvas, tempCtx;

            for (let i = 0; i < passes.length; i++) {
                const passScale = passes[i];
                const newWidth = Math.round(currentImg.width * passScale);
                const newHeight = Math.round(currentImg.height * passScale);

                tempCanvas = document.createElement('canvas');
                tempCanvas.width = newWidth;
                tempCanvas.height = newHeight;
                tempCtx = tempCanvas.getContext('2d');
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';

                // Clear canvas to preserve transparency
                tempCtx.clearRect(0, 0, newWidth, newHeight);
                tempCtx.drawImage(currentImg, 0, 0, newWidth, newHeight);
                currentImg = tempCanvas;
            }

            return tempCanvas;
        } else {
            // Single pass for upscaling or small downscaling
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            // Clear canvas to preserve transparency
            tempCtx.clearRect(0, 0, targetWidth, targetHeight);
            tempCtx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);
            return tempCanvas;
        }
    }

    updatePreview() {
        if (!this.originalImage) return;

        const img = this.originalImage;
        const size = this.currentSize;

        // Calculate dimensions maintaining aspect ratio
        let newWidth, newHeight;
        if (img.naturalWidth > img.naturalHeight) {
            newWidth = size;
            newHeight = Math.round((img.naturalHeight / img.naturalWidth) * size);
        } else {
            newHeight = size;
            newWidth = Math.round((img.naturalWidth / img.naturalHeight) * size);
        }

        // Set canvas size
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        // Set canvas CSS size for pixel-perfect rendering
        this.canvas.style.width = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;

        // Clear canvas to ensure transparent background
        this.ctx.clearRect(0, 0, newWidth, newHeight);

        // Use multi-pass scaling for better quality
        const scaledCanvas = this.multiPassScale(img, newWidth, newHeight);
        this.ctx.drawImage(scaledCanvas, 0, 0);
    }

    updateOutputSize() {
        if (!this.originalImage) return;

        const img = this.originalImage;
        const size = this.currentSize;

        // Calculate dimensions maintaining aspect ratio
        let newWidth, newHeight;
        if (img.naturalWidth > img.naturalHeight) {
            newWidth = size;
            newHeight = Math.round((img.naturalHeight / img.naturalWidth) * size);
        } else {
            newHeight = size;
            newWidth = Math.round((img.naturalWidth / img.naturalHeight) * size);
        }

        this.outputSizeDisplay.textContent = `Output Size: ${newWidth}×${newHeight} (original: ${img.naturalWidth}×${img.naturalHeight})`;
    }

    handleSizeChange(e) {
        this.currentSize = parseInt(e.target.value);
        this.updatePreview();
        this.updateOutputSize();
    }

    showControls() {
        // Hide drop zone and show controls
        this.dropZone.style.display = 'none';
        this.controls.style.display = 'block';
        this.previewContainer.style.display = 'block';
    }

    async downloadGif() {
        if (!this.originalImage) return;
        
        try {
            this.downloadBtn.disabled = true;
            this.downloadBtn.textContent = '⏳ Converting to GIF...';
            
            // Create GIF using gif.js library
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: this.canvas.width,
                height: this.canvas.height,
                workerScript: 'gif-js/gif.worker.js',
                transparent: 'rgba(0,0,0,0)'
            });

            // Add the current canvas as a frame
            gif.addFrame(this.canvas, { delay: 1000 });

            // Render and download
            gif.on('finished', (blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'converted_image.gif';
                link.href = url;
                link.click();
                
                // Clean up
                URL.revokeObjectURL(url);
                
                this.downloadBtn.disabled = false;
                this.downloadBtn.textContent = '📥 Download GIF';
            });

            gif.render();
            
        } catch (error) {
            console.error('Error creating GIF:', error);
            // Fallback to PNG download
            const dataUrl = this.canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'converted_image.png';
            link.href = dataUrl;
            link.click();
            alert('GIF conversion failed. Downloaded as PNG instead.');
            
            this.downloadBtn.disabled = false;
            this.downloadBtn.textContent = '📥 Download GIF';
        }
    }

    resetToUpload() {
        // Reset all states
        this.originalImage = null;
        this.currentScale = 1;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Reset file input
        this.fileInput.value = '';
        
        // Hide controls and show drop zone
        this.controls.style.display = 'none';
        this.previewContainer.style.display = 'none';
        this.dropZone.style.display = 'block';
        
        // Reset slider
        this.sizeSlider.value = 128;
        this.currentSize = 128;
        this.outputSizeDisplay.textContent = 'Output Size: 128×128 (original: 1024×768)';
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ImageToGifConverter();
});