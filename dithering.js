var canvas, context;
var originalImage, originalData;
var progressBar, applyButton;

function $(id) {
  return document.getElementById(id);
}

function addClass(e, cls) {
  e.className += ' ' + cls;
}

function removeClass(e, cls) {
  e.className = e.className.replace(new RegExp('(^| )'+cls+'($| )'), '');
}

document.addEventListener('DOMContentLoaded', function() {
  setup();
});

function setup() {
  canvas = $('demo');
  progressBar = $('progressBar');
  applyButton = $('applyButton');
  originalImage = $('tiger_img');

  context = canvas.getContext('2d');
  if (originalImage.complete) {
    drawOriginalImage();
  } else {
    originalImage.addEventListener('load', drawOriginalImage);
  }

  applyButton.addEventListener('click', function(event) {
    // Start the dithering calculation in a WebWorker.
    var worker = new Worker('dither_algorithms.js');
    worker.onmessage = function(e) {
      if (e.data.type == 'complete') {
        ditherComplete(e.data.imageData);
      } else if (e.data.type == 'progressUpdate') {
        progressBar.value = e.data.value;
      }
    };
    worker.postMessage({
      ditherType: $('ditherType').value,
      colourPalette: $('colourPalette').value,
      imageData: originalData
    });
    ditherStarted();
  });
  $('resetButton').addEventListener('click', drawOriginalImage);
}

function ditherStarted() {
  // Change the Apply button to a progress bar.
  progressBar.value = 0;
  removeClass(progressBar, 'hidden');
  addClass(applyButton, 'hidden');
}

function ditherComplete(imageData) {
  // Render the finished image.
  context.putImageData(imageData, 0, 0);

  // Change the progress bar to an Apply button.
  addClass(progressBar, 'hidden');
  removeClass(applyButton, 'hidden');
}

function drawOriginalImage() {
  context.drawImage(originalImage, 0, 0);
  originalData = context.getImageData(0, 0, canvas.width, canvas.height);
}
