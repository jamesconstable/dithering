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
  context = canvas.getContext('2d');
  originalImage = $('tiger_img');
  if (originalImage.complete) {
    drawOriginalImage();
  } else {
    originalImage.addEventListener('load', drawOriginalImage);
  }

  progressBar = $('progressBar');
  applyButton = $('applyButton');
  applyButton.addEventListener('click', function(event) {
    var worker = new Worker('dither_algorithms.js');
    worker.onmessage = function(e) {
      if (e.data.type == 'complete') {
        context.putImageData(e.data.imageData, 0, 0);
      }
    };
    worker.postMessage({
      ditherType: $('ditherType').value,
      colourPalette: $('colourPalette').value,
      imageData: originalData
    });
  });
  $('resetButton').addEventListener('click', drawOriginalImage);
}

function drawOriginalImage() {
  context.drawImage(originalImage, 0, 0);
  originalData = context.getImageData(0, 0, canvas.width, canvas.height);
}
