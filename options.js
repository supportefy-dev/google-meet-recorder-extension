const config = MeetRecorderConfig;
const license = MeetRecorderLicense;
const settingsLib = MeetRecorderSettings;

const form = {
  videoFormat: document.querySelectorAll('input[name="videoFormat"]'),
  audioQuality: document.querySelectorAll('input[name="audioQuality"]'),
  separateTracks: document.querySelector('#separateTracks'),
  filenameTemplate: document.querySelector('#filenameTemplate'),
  subfolder: document.querySelector('#subfolder'),
};
const filenamePreview = document.querySelector('#filenamePreview');
const saveStatus = document.querySelector('#saveStatus');
const proSection = document.querySelector('#proSection');
const proLoading = document.querySelector('#proLoading');
const proUnlicensed = document.querySelector('#proUnlicensed');
const proLicensed = document.querySelector('#proLicensed');
const licensedEmail = document.querySelector('#licensedEmail');
const earlyBirdBlock = document.querySelector('#earlyBirdBlock');
const earlyBirdLink = document.querySelector('#earlyBirdLink');
const earlyBirdSeats = document.querySelector('#earlyBirdSeats');
const buyButton = document.querySelector('#buyButton');
const buyPrice = document.querySelector('#buyPrice');
const proPrice = document.querySelector('#proPrice');
const donateLink = document.querySelector('#donateLink');
const activateForm = document.querySelector('#activateForm');
const licenseKeyInput = document.querySelector('#licenseKey');
const activateButton = document.querySelector('#activateButton');
const licenseError = document.querySelector('#licenseError');
const removeLicenseButton = document.querySelector('#removeLicenseButton');

const sampleNow = new Date();
let saveTimer = null;
let licensedNow = false;

function currency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: config.currency }).format(amount);
}

function jumpToProSection() {
  proSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  licenseKeyInput.focus();
}

function guardProControl(event, control) {
  if (licensedNow) return;
  event.preventDefault();
  control.blur();
  jumpToProSection();
}

const gatedControls = new WeakSet();
function gateRadio(input) {
  if (gatedControls.has(input)) return;
  gatedControls.add(input);
  input.addEventListener('click', event => guardProControl(event, input));
  input.addEventListener('keydown', event => {
    if ((event.key === ' ' || event.key === 'Enter') && !licensedNow) guardProControl(event, input);
  });
}

function applyLicenseGate() {
  // Video recording itself is a Pro feature now, not just the MP4 format choice.
  form.videoFormat.forEach(input => gateRadio(input));
  form.audioQuality.forEach(input => { if (input.value !== 'mp3-64') gateRadio(input); });
  gateRadio(form.separateTracks);
  form.filenameTemplate.readOnly = !licensedNow;
  form.subfolder.readOnly = !licensedNow;
}

function gateTextInput(input) {
  input.addEventListener('focus', () => {
    if (!licensedNow) { input.blur(); jumpToProSection(); }
  });
}

function currentFormValues() {
  return {
    videoFormat: document.querySelector('input[name="videoFormat"]:checked')?.value || 'webm',
    audioQuality: document.querySelector('input[name="audioQuality"]:checked')?.value || 'mp3-64',
    separateTracks: form.separateTracks.checked,
    filenameTemplate: form.filenameTemplate.value,
    subfolder: form.subfolder.value,
  };
}

function updatePreview() {
  const values = currentFormValues();
  const filename = MeetRecorderFilename.buildFilename({
    template: values.filenameTemplate,
    mode: 'audio',
    extension: values.audioQuality === 'wav' ? 'wav' : 'mp3',
    title: 'Weekly Sync',
    subfolder: values.subfolder,
    now: sampleNow,
  });
  filenamePreview.textContent = `Preview: ${filename}`;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(async () => {
    await settingsLib.save(currentFormValues());
    saveStatus.textContent = 'Saved';
    setTimeout(() => { if (saveStatus.textContent === 'Saved') saveStatus.textContent = ''; }, 1500);
  }, 300);
}

function renderForm(values) {
  form.videoFormat.forEach(input => { input.checked = input.value === values.videoFormat; });
  form.audioQuality.forEach(input => { input.checked = input.value === values.audioQuality; });
  form.separateTracks.checked = values.separateTracks;
  form.filenameTemplate.value = values.filenameTemplate;
  form.subfolder.value = values.subfolder;
  updatePreview();
}

function renderLicenseState(status) {
  licensedNow = Boolean(status.pro);
  proLoading.hidden = true;
  proUnlicensed.hidden = licensedNow;
  proLicensed.hidden = !licensedNow;
  if (licensedNow) licensedEmail.textContent = status.email || 'you';
  applyLicenseGate();
}

function renderEarlyBird() {
  if (!config.earlyBird?.open) { earlyBirdBlock.hidden = true; return; }
  earlyBirdBlock.hidden = false;
  earlyBirdSeats.textContent = String(config.earlyBird.seats);
  const subject = encodeURIComponent('Meet Recorder early bird key');
  earlyBirdLink.href = `mailto:${config.earlyBird.claimEmail}?subject=${subject}`;
}

async function init() {
  proPrice.textContent = `${currency(config.price)} one time`;
  buyPrice.textContent = currency(config.price);
  buyButton.href = config.paypalUrl;
  donateLink.href = config.donateUrl;
  renderEarlyBird();

  renderForm(await settingsLib.load());
  renderLicenseState(await license.current());

  if (location.hash === '#pro') jumpToProSection();
}

[...form.videoFormat, ...form.audioQuality].forEach(input => {
  input.addEventListener('change', () => { updatePreview(); scheduleSave(); });
});
form.separateTracks.addEventListener('change', scheduleSave);
form.filenameTemplate.addEventListener('input', () => { updatePreview(); scheduleSave(); });
form.subfolder.addEventListener('input', scheduleSave);
gateTextInput(form.filenameTemplate);
gateTextInput(form.subfolder);

activateForm.addEventListener('submit', async event => {
  event.preventDefault();
  licenseError.hidden = true;
  activateButton.disabled = true;
  activateButton.textContent = 'Activating...';
  try {
    const result = await license.activate(licenseKeyInput.value);
    if (!result.ok) {
      licenseError.textContent = 'That key could not be verified. Check for typos and try again.';
      licenseError.hidden = false;
      return;
    }
    licenseKeyInput.value = '';
    renderLicenseState({ pro: true, email: result.email });
  } finally {
    activateButton.disabled = false;
    activateButton.textContent = 'Activate';
  }
});

removeLicenseButton.addEventListener('click', async () => {
  await license.deactivate();
  renderLicenseState({ pro: false });
});

license.onLicenseChange(status => renderLicenseState(status));

init();
