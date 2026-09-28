// Minimal, valid Office Open XML (.docx) generated in the browser.
import { zipSync, strToU8 } from 'fflate'
import { plainText } from './model.js'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** XML-escape and strip characters that are illegal in XML 1.0. */
export function xmlEscape(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function run(r) {
  if (r.text === '\n') return '<w:r><w:br/></w:r>'
  const props = (r.bold ? '<w:b/>' : '') + (r.italic ? '<w:i/>' : '')
  const parts = r.text.split('\n')
  return parts.map((t, i) =>
    (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEscape(t)}</w:t></w:r>`,
  ).join('')
}

const para = (style, runs, extra = '') =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${runs.map(run).join('')}</w:p>`

function blockXml(b) {
  switch (b.type) {
    case 'heading': return para(b.level <= 2 ? 'Heading2' : 'Heading3', b.runs)
    case 'quote': return para('Quote', b.runs)
    case 'hr': return para('SceneBreak', [{ text: '*   *   *' }])
    case 'bullet': return para('ListBullet', [{ text: '• ' }, ...b.runs])
    case 'number': return para('ListNumber', b.runs)
    default: return para('BodyText', b.runs)
  }
}

export function buildDocumentXml(story) {
  const body = [para('Title', [{ text: story.title }])]
  if (story.authors.length) body.push(para('Subtitle', [{ text: 'by ' + story.authors.join(', ') }]))
  if (story.premise) body.push(para('Quote', [{ text: story.premise }]))
  for (const sec of story.sections) {
    if (sec.heading) body.push(para('Heading1', [{ text: sec.heading }]))
    let n = 0
    for (const b of sec.blocks) {
      if (b.type === 'number') b.runs = [{ text: `${++n}. ` }, ...b.runs]
      else n = 0
      body.push(blockXml(b))
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

const style = (id, name, { size, bold, italic, align, before = 0, after = 160, indent, font } = {}) =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="${before}" w:after="${after}"/>${align ? `<w:jc w:val="${align}"/>` : ''}${indent ? `<w:ind w:left="${indent}" w:right="${indent}"/>` : ''}</w:pPr><w:rPr>${font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>` : ''}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}</w:rPr></w:style>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${style('BodyText', 'Body Text', { after: 200 })}
${style('Title', 'Title', { size: 52, bold: true, align: 'center', after: 240 })}
${style('Subtitle', 'Subtitle', { size: 26, italic: true, align: 'center', after: 360 })}
${style('Heading1', 'heading 1', { size: 34, bold: true, before: 480, after: 200 })}
${style('Heading2', 'heading 2', { size: 28, bold: true, before: 360, after: 160 })}
${style('Heading3', 'heading 3', { size: 24, bold: true, italic: true, before: 240, after: 120 })}
${style('Quote', 'Quote', { italic: true, indent: 720 })}
${style('SceneBreak', 'Scene Break', { align: 'center', before: 240, after: 240 })}
${style('ListBullet', 'List Bullet', { indent: 360, after: 80 })}
${style('ListNumber', 'List Number', { indent: 360, after: 80 })}
</w:styles>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

function coreXml(story, now) {
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(story.title)}</dc:title><dc:creator>${xmlEscape(story.authors.join(', ') || 'StoryWeave')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>StoryWeave</Application></Properties>`

export function toDocx(story, now = new Date()) {
  const files = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'word/document.xml': strToU8(buildDocumentXml(structuredClone(story))),
    'word/styles.xml': strToU8(STYLES),
    'word/_rels/document.xml.rels': strToU8(DOC_RELS),
    'docProps/core.xml': strToU8(coreXml(story, now)),
    'docProps/app.xml': strToU8(APP_XML),
  }
  return zipSync(files, { level: 6 })
}

export { plainText }
