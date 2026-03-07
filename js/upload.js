// handling everything related to file uploads here — drag & drop, clicking, validation, and parsing
// supporting CSV, Excel, PDF, and Word

const FinSiteUpload = (() => {

  let _onFileReady = null;
  let _currentFile = null;

  // wiring up the drop zone and file input
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

  // rejecting files whose reported MIME type is explicitly dangerous — defense in depth on top of the extension check
  const _BLOCKED_MIMES = new Set([
    'application/javascript', 'text/javascript', 'application/x-javascript',
    'text/html', 'application/xhtml+xml',
    'application/x-httpd-php', 'application/x-sh', 'application/x-csh',
    'application/x-executable', 'application/x-msdownload', 'application/x-msdos-program',
    'application/x-bat',
  ]);

  // checking the file is something I can actually read, then passing it along
  function handleFile(file) {
    const validExts = ['.csv', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();
    const validExt = validExts.some(ext => fileName.endsWith(ext));

    if (!validExt) {
      showError('Please upload a supported file: CSV, Excel (.xls/.xlsx), PDF, or Word (.doc/.docx).');
      return;
    }

    if (_BLOCKED_MIMES.has((file.type || '').toLowerCase())) {
      showError('File type not allowed.');
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

  // figuring out the file type and using the right parser
  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return _readPDF(file);
    if (ext === 'doc' || ext === 'docx') return _readWord(file);
    if (ext === 'xls' || ext === 'xlsx') return _readExcel(file);
    // plain text / CSV — reading it directly
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // shared helper for the binary parsers below
  function _readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // extracting text from each page using pdf.js
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

  // using mammoth to pull the raw text out of .doc/.docx files
  async function _readWord(file) {
    if (typeof mammoth === 'undefined') throw new Error('Mammoth.js library failed to load. Check your internet connection.');
    const buffer = await _readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // using sheetjs to convert the first sheet to CSV text so the AI can read it
  async function _readExcel(file) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS library failed to load. Check your internet connection.');
    const buffer = await _readAsArrayBuffer(file);
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  // swapping the drop zone UI to show the selected file name and size
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

  // showing an error in the UI and auto-hiding it after 4 seconds
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
