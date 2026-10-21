"""Re-render synthetic PDFs with PyMuPDF and independently extract their text with pypdf."""
from pathlib import Path
import hashlib
import json

import pymupdf
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parent
results = []
for source in root.glob('*.pdf'):
    document = pymupdf.open(source)
    reader = PdfReader(source)
    text = '\n'.join(str(arguments[1]['/ActualText']) for page in reader.pages
                     for arguments, operator in ContentStream(page.get_contents(), reader).operations
                     if operator == b'BDC' and '/ActualText' in arguments[1])
    raw_text = '\n'.join(page.extract_text() for page in reader.pages)
    (root / (source.stem + '.txt')).write_text(text, encoding='utf-8')
    names = ['محمد أحمد', 'אביגיל', 'अर्जुन'] if 'multiscript' in source.stem else ['Zoë García', '李明', 'Олена Коваль']
    for phrase in names + ['+1 415 555 0102',
                   '2026-10-20T10:02:00.000Z', 'Pet agreement - approved cat.pdf']:
        assert phrase in text, (source.name, phrase)
    for phrase in ['2450.00', '2027-10-31', 'tenant@example.test']:
        assert phrase in raw_text, (source.name, phrase)
    if 'long' in source.stem:
        assert text.count('FINAL AGREED SENTENCE.') == 2
    violations = []
    renders = []
    for index, page in enumerate(document):
        render = root / f'{source.stem}-page-{index + 1}.png'
        page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(render)
        renders.append(render)
        for word in page.get_text('words'):
            if word[0] < 46 or word[2] > 566 or word[1] < 18 or word[3] > 767:
                violations.append({'page': index + 1, 'word': word[4], 'box': word[:4]})
    assert not violations, violations
    for offset in range(0, len(renders), 4):
        contact = pymupdf.open()
        sheet = contact.new_page(width=1224, height=1624)
        for index, render in enumerate(renders[offset:offset + 4]):
            x, y = (index % 2) * 612, (index // 2) * 812
            sheet.insert_text((x + 12, y + 12), f'Page {offset + index + 1}', fontsize=9)
            sheet.insert_image(pymupdf.Rect(x, y + 20, x + 612, y + 812), filename=render)
        sheet.get_pixmap().save(root / f'{source.stem}-contact-{offset // 4 + 1}.png')
    results.append({'file': source.name, 'pages': len(document), 'bytes': source.stat().st_size,
                    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'textCharacters': len(text), 'boundsViolations': violations,
                    'textChecks': 'passed'})
(root / 'inspection-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(json.dumps(results))
