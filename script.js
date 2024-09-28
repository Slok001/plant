const API_KEY = 'AIzaSyBs8VIj2Y0smjU4OtJDPFUBVV1mmHOWYgQ';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.id.replace('Tab', 'Content')).classList.add('active');
        });
    });

    ['Identify', 'Diagnose'].forEach(action => {
        document.getElementById(`gallery${action}`).addEventListener('click', () => openGallery(action));
        document.getElementById(`takePhoto${action}`).addEventListener('click', () => openCamera(action));
        document.getElementById(`${action.toLowerCase()}Plant`).addEventListener('click', () => processImage(action));
    });

    // Dark mode toggle
    const darkModeIcon = document.getElementById('darkModeIcon');

    darkModeIcon.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        
        // Change icon and add animation
        darkModeIcon.classList.toggle('fa-sun', isDarkMode);
        darkModeIcon.classList.toggle('fa-moon', !isDarkMode);
        darkModeIcon.classList.add('animating');
        setTimeout(() => {
            darkModeIcon.classList.remove('animating');
        }, 500);
    });

    // Check for saved dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    // Add this to your existing DOMContentLoaded event listener
    darkModeIcon.addEventListener('mouseenter', () => {
        darkModeIcon.classList.add('hover');
    });

    darkModeIcon.addEventListener('mouseleave', () => {
        darkModeIcon.classList.remove('hover');
    });

    setupCameraButtons();
});

function openGallery(action) {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = (e) => {
        selectedFile = e.target.files[0];
        document.getElementById(`fileInfo${action}`).textContent = `Selected: ${selectedFile.name}`;
    };
    
    fileInput.click();
}

function openCamera(action) {
    navigator.camera.getPicture(onSuccess, onFail, { 
        quality: 50,
        destinationType: Camera.DestinationType.FILE_URI 
    });

    function onSuccess(imageURI) {
        selectedFile = imageURI;
        document.getElementById(`fileInfo${action}`).textContent = `Photo captured: ${imageURI}`;
    }

    function onFail(message) {
        alert('Failed because: ' + message);
    }
}

function createCustomCameraInterface(action) {
    const cameraTab = document.createElement('div');
    cameraTab.id = 'customCameraTab';
    cameraTab.innerHTML = `
        <div class="camera-container">
            <video id="cameraPreview" autoplay playsinline></video>
            <div class="camera-overlay">
                <div id="cameraControls">
                    <button id="captureButton"><i class="fas fa-camera"></i></button>
                    <button id="rotateButton"><i class="fas fa-sync-alt"></i></button>
                    <button id="backButton"><i class="fas fa-times"></i></button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(cameraTab);

    const video = document.getElementById('cameraPreview');
    let currentFacingMode = 'environment';

    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
        .then(stream => {
            video.srcObject = stream;

            document.getElementById('captureButton').onclick = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                canvas.toBlob(blob => {
                    handleCapturedImage(new File([blob], "camera_capture.jpg", { type: "image/jpeg" }), action);
                    closeCameraInterface(stream);
                }, 'image/jpeg');
            };

            document.getElementById('rotateButton').onclick = () => {
                currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                stream.getTracks().forEach(track => track.stop());
                navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
                    .then(newStream => {
                        video.srcObject = newStream;
                    });
            };

            document.getElementById('backButton').onclick = () => closeCameraInterface(stream);
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            alert('Error accessing camera. Please try again or use the gallery option.');
            closeCameraInterface();
        });
}

function closeCameraInterface(stream) {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    const cameraTab = document.getElementById('customCameraTab');
    if (cameraTab) {
        cameraTab.remove();
    }
}

function handleCapturedImage(file, action) {
    selectedFile = file;
    document.getElementById(`fileInfo${action}`).textContent = `Photo captured: ${selectedFile.name}`;
}

async function processImage(action) {
    if (!selectedFile) {
        alert('Please select an image or take a photo first.');
        return;
    }

    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'block';
    
    // Clear previous results
    document.getElementById(`${action.toLowerCase()}Result`).innerHTML = '';

    const prompt = action === 'Identify' 
        ? "Identify this plant and provide details including its name, scientific name, key characteristics, location, and additional info."
        : "Diagnose the disease in this plant image. Provide the disease name, specifications, and how to cure it.";

    try {
        // Convert the selected file to base64
        const base64Image = await fileToBase64(selectedFile);

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { 
                            inline_data: { 
                                mime_type: selectedFile.type,
                                data: base64Image
                            } 
                        }
                    ]
                }]
            })
        });

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const result = data.candidates[0].content.parts[0].text;
            document.getElementById(`${action.toLowerCase()}Result`).innerHTML = formatResult(result, action);
        } else {
            throw new Error('Unexpected API response structure');
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById(`${action.toLowerCase()}Result`).textContent = 'An error occurred. Please try again.';
    } finally {
        // Hide loading spinner
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    // Reset selected file after processing
    selectedFile = null;
    document.getElementById(`fileInfo${action}`).textContent = 'No file chosen';
}


// Helper function to convert File to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function formatResult(result, action) {
    const lines = result.split('\n').filter(line => line.trim() !== '');
    let formattedResult = '<div class="result-container">';

    if (action === 'Identify') {
        formattedResult += `
            <div class="result-item"><h3>Plant Name</h3><p>${lines[0] || 'Not available'}</p></div>
            <div class="result-item"><h3>Scientific Name</h3><p>${lines[1] || 'Not available'}</p></div>
            <div class="result-item"><h3>Plant Details</h3><p><strong>Key Characteristics:</strong> ${lines[2] || 'Not available'}</p></div>
            <div class="result-item"><h3>Plant Location</h3><p>${lines[3] || 'Not available'}</p></div>
            <div class="result-item"><h3>Additional Info</h3><p>${lines[4] || 'Not available'}</p></div>
        `;
    } else {
        formattedResult += lines.map(line => `<div class="result-item"><p>${line}</p></div>`).join('');
    }

    formattedResult += '</div>';

    setTimeout(() => {
        const resultElement = document.getElementById(`${action.toLowerCase()}Result`);
        resultElement.classList.add('show');
        const resultItems = resultElement.querySelectorAll('.result-item');
        resultItems.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('show');
            }, index * 100);
        });
    }, 100);

    return formattedResult;
}

function setupCameraButtons() {
    const takePhotoButtons = document.querySelectorAll('#takePhotoIdentify, #takePhotoDiagnose');
    takePhotoButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // Check if we're running from a file:// URL
                if (window.location.protocol === 'file:') {
                    alert("Camera access is not available when running from a local file. Please use the Gallery option or host the app on a web server.");
                    return;
                }
                
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(function(stream) {
                        // Here you would typically open a modal with a video stream
                        // For simplicity, we'll just create a temporary file input
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'camera';
                        input.click();
                        
                        input.onchange = function(event) {
                            handleFileSelection(event.target.files[0], button.id.includes('Identify') ? 'Identify' : 'Diagnose');
                        };
                    })
                    .catch(function(error) {
                        console.error("Camera error: ", error);
                        fallbackToFileInput(button);
                    });
            } else {
                fallbackToFileInput(button);
            }
        });
    });
}

function fallbackToFileInput(button) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
    
    input.onchange = function(event) {
        handleFileSelection(event.target.files[0], button.id.includes('Identify') ? 'Identify' : 'Diagnose');
    };
}