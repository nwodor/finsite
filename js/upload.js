// i handle everything related to file uploads here — drag & drop, clicking, validation, and parsing
// i support CSV, Excel, PDF, and Word

const FinSiteUpload = (() => {

  let _onFileReady = null;
  let _currentFile = null;

  // i wire up the drop zone and file input
  function init(zoneId, onFileReady) {
    _onFileReady = onFileReady;

    const zone = document.getElementById(zoneId);
    const fileInput = document.getElementById('file-input');

    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  // i check the file is something i can actually read, then pass it along
  function handleFile(file) {
    const validExts = ['.csv', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();
    const validExt = validExts.some(ext => fileName.endsWith(ext));

    if (!validExt) {
      showError('Please upload a supported file: CSV, Excel (.xls/.xlsx), PDF, or Word (.doc/.docx).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File is too large. Please upload a file under 5MB.');
      return;
    }

    _currentFile = file;
    updateZoneUI(file);
    if (_onFileReady) _onFileReady(file);
  }

  // i figure out the file type and use the right parser
  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return _readPDF(file);
    if (ext === 'doc' || ext === 'docx') return _readWord(file);
    if (ext === 'xls' || ext === 'xlsx') return _readExcel(file);
    // plain text / CSV — i just read it directly
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // i use this helper in the binary parsers below
  function _readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // i extract text from each page using pdf.js
  async function _readPDF(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js library failed to load. Check your internet connection.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buffer = await _readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

  // i use mammoth to pull the raw text out of .doc/.docx files
  async function _readWord(file) {
    if (typeof mammoth === 'undefined') throw new Error('Mammoth.js library failed to load. Check your internet connection.');
    const buffer = await _readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // i use sheetjs to convert the first sheet to CSV text so claude can read it
  async function _readExcel(file) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS library failed to load. Check your internet connection.');
    const buffer = await _readAsArrayBuffer(file);
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  // i swap the drop zone UI to show the selected file name and size
  function updateZoneUI(file) {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;

    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${sizeKB} KB`;

    zone.innerHTML = `
      <div class="upload-icon" style="background: var(--green-100);">✅</div>
      <div style="font-size:16px; font-weight:700; margin-bottom:6px; color: var(--green-700);">
        ${escapeHtml(file.name)}
      </div>
      <div style="font-size:13px; color: var(--text-muted); margin-bottom:12px;">
        ${sizeStr} · Ready to analyze
      </div>
      <span class="badge badge-green">Click to change file</span>
    `;
  }

  // i show an error in the UI and auto-hide it after 4 seconds
  function showError(message) {
    const errEl = document.getElementById('upload-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
      setTimeout(() => { errEl.style.display = 'none'; }, 4000);
    } else {
      alert(message);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function getCurrentFile() { return _currentFile; }

  return { init, readFile, getCurrentFile, handleFile };
})();
