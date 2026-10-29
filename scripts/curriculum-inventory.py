"""Reproducible NaCCA reference inventory; not a lesson/question generator.

Extracts only factual identifiers/page references. PDF instructional text stays in
the ignored local research cache. Editorial review is required before publishing
coverage claims. Requires pypdf; use --scan to inspect likely content start pages.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/learningHub/curriculum'
CACHE = ROOT / '.temp/curriculum-inventory'
CODE = re.compile(r'(?<![A-Za-z0-9])B\s*([1-9])(?:\s*\.\s*|\s+)(\d+)\s*\.\s*(\d+)\s*\.\s*(\d+)\s*\.\s*(\d+)(?!\d)', re.I)

def pages_for(source):
    path = ROOT / source['localPath']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    cached = CACHE / (digest + '.json')
    if cached.exists():
        pages = json.loads(cached.read_text(encoding='utf-8'))
    else:
        pages = [p.extract_text() or '' for p in PdfReader(path).pages]
        cached.write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
    return digest, pages

def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = json.loads((OUT / 'sources.json').read_text(encoding='utf-8'))
    documents, indicators = [], []
    for source in sources:
        if not (ROOT / source['localPath']).exists():
            documents.append({**source, 'status':'source-unavailable', 'indicatorCount':None})
            continue
        digest, pages = pages_for(source)
        found, excluded, forms = {}, {}, {}
        start = source.get('firstContentPage')
        for number, text in enumerate(pages, 1):
            codes = set()
            for match in CODE.finditer(text):
                code = 'B'+'.'.join(str(int(v)) for v in match.groups())
                codes.add(code)
                forms.setdefault(code, set()).add(' '.join(match.group(0).split()))
            if '--scan' in sys.argv and codes and (number < 45):
                print(source['id'], number, ','.join(sorted(codes)[:5]), flush=True)
            for code in codes:
                target = found if start and number >= start and int(code[1]) in source['grades'] else excluded
                target.setdefault(code, []).append(number)
        entries = []
        for code, locations in sorted(found.items(), key=lambda pair: tuple(map(int, pair[0][1:].split('.')))):
            entries.append({'id':source['subjectId']+':'+code, 'subject':source['subject'],
                'level':code[:2], 'code':code, 'contentStandard':code.rsplit('.',1)[0],
                'strandCode':'.'.join(code.split('.')[:2]), 'subStrandCode':'.'.join(code.split('.')[:3]),
                'sourceId':source['id'], 'sourceUrl':source['url'], 'pages':locations,
                'sourceCodeForms':sorted(forms[code]),
                'reviewStatus':'reference-extracted; meaning-and-table-placement-unverified'})
        indicators.extend(entries)
        documents.append({**source, 'sha256':digest, 'pdfPages':len(pages),
            'status':'references-extracted' if start else 'needs-content-start-review',
            'indicatorCount':len(entries), 'byLevel':{f'B{g}':sum(e['level']==f'B{g}' for e in entries) for g in source['grades']},
            'excludedReferences':[{'code':code,'pages':locations} for code,locations in sorted(excluded.items())]})
        print(source['id'], 'COUNT', len(entries), flush=True)
    if '--scan' not in sys.argv:
        (OUT / 'indicatorReferences.json').write_text(json.dumps(indicators, indent=2)+'\n', encoding='utf-8')
        (OUT / 'sourceAudit.json').write_text(json.dumps(documents, indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
