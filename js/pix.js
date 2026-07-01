/* ============================================================
   PIX — gerador do "copia e cola" (BR Code / EMV) + QR Code
   Tudo local, nenhum dado sai do navegador.
   ============================================================ */

function tlv(id, value) { const len = String(value.length).padStart(2, '0'); return id + len + value; }

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function san(s, max) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, max);
}

/* Monta o payload Pix. key = chave Pix da empresa. amount opcional (number). */
export function pixPayload({ key, name, city, amount, txid }) {
  if (!key) return '';
  const mai = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key));
  const amt = amount ? tlv('54', Number(amount).toFixed(2)) : '';
  const adf = tlv('62', tlv('05', (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
  const semCRC =
    tlv('00', '01') + tlv('01', '11') + mai + tlv('52', '0000') + tlv('53', '986') +
    amt + tlv('58', 'BR') + tlv('59', san(name, 25) || 'FLEX DRIVE') + tlv('60', san(city, 15) || 'BRASILIA') + adf + '6304';
  return semCRC + crc16(semCRC);
}

/* Gera o QR Code como data URL (best-effort; se a lib não carregar, retorna null) */
export async function pixQrDataUrl(payload) {
  if (!payload) return null;
  try {
    const mod = await import('https://esm.sh/qrcode-generator@1.4.4');
    const qrcode = mod.default || mod;
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    return qr.createDataURL(6, 10);
  } catch (e) { return null; }
}
