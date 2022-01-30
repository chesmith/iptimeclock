// Used to encrypt config entries using the private key
// Note - Depends on a file named key.txt, containing the private key, to be in the same folder as this script
//
// Usage: node encrypt "<string to encrypt>"
//
// The script will return an "encrypted" value - use this value in your config

const crypto = require('crypto');
const fs = require('fs');

const _key = fs.readFileSync('key.txt', 'utf8');

function encrypt(text) {
	let iv = crypto.randomBytes(16);
	let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(_key, 'hex'), iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
}

function decrypt(data, iv) {
	let encryptedText = Buffer.from(data, 'hex');
	let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(_key, 'hex'), Buffer.from(iv, 'hex'));
	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
}

var hw = encrypt(process.argv[2]);
console.log(`input......: ${process.argv[2]}`);
console.log(`encrypted..: ${hw.iv}${hw.data}`);
console.log(`validate: ${decrypt(hw.data, hw.iv)}`);