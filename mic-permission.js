const allowButton = document.querySelector('#allowButton');
const message = document.querySelector('#message');

allowButton.addEventListener('click', async () => {
  allowButton.disabled = true;
  message.textContent = 'Waiting for Chrome microphone permission…';
  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    permissionStream.getTracks().forEach(track => track.stop());
    message.textContent = 'Adding microphone to the active recording…';
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
    const stored = (await chrome.storage.local.get('selectedMicId')).selectedMicId;
    const deviceId = devices.some(device => device.deviceId === stored)
      ? stored
      : (devices.find(device => device.deviceId === 'default') || devices[0])?.deviceId;
    if (deviceId) await chrome.storage.local.set({ selectedMicId: deviceId });
    const result = await chrome.runtime.sendMessage({ type: 'ENABLE_MIC', deviceId });
    if (!result?.ok) throw new Error(result?.error || 'The recorder could not enable the microphone.');
    await chrome.storage.local.set({ micPermissionGranted: true });
    document.body.classList.add('success');
    message.textContent = 'Microphone enabled. Return to Google Meet and use the extension to mute or unmute it.';
    allowButton.querySelector('span').textContent = 'Microphone enabled';
    allowButton.querySelector('i').textContent = '✓';
    setTimeout(() => window.close(), 1100);
  } catch (error) {
    await chrome.storage.local.set({ micPermissionGranted: false });
    message.textContent = `Microphone could not be enabled: ${error.message}`;
    allowButton.disabled = false;
  }
});
