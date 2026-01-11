import sys
import zipfile
import hashlib
import base64
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding
from cryptography.hazmat.primitives.serialization import pkcs7

def sha1_digest(data):
    return hashlib.sha1(data).digest()

def sha256_digest(data):
    return hashlib.sha256(data).digest()

def get_manifest_entries(zip_ref):
    manifest = []
    for info in zip_ref.infolist():
        if info.filename.startswith("META-INF/"):
            continue
        data = zip_ref.read(info)
        digest = base64.b64encode(sha1_digest(data)).decode('utf-8')
        manifest.append(f"Name: {info.filename}\r\nSHA1-Digest: {digest}\r\n\r\n")
    return "".join(manifest)

def sign_zip(input_zip, output_zip, key_path, cert_path):
    with open(key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
    
    with open(cert_path, "rb") as f:
        cert_data = f.read()
        cert = x509.load_pem_x509_certificate(cert_data)

    # 1. Create Manifest
    with zipfile.ZipFile(input_zip, "r") as zin:
        manifest_content = "Manifest-Version: 1.0\r\nCreated-By: Hymo Signer\r\n\r\n"
        manifest_entries = get_manifest_entries(zin)
        full_manifest = manifest_content + manifest_entries

    # 2. Create Signature File (SF)
    sf_content = "Signature-Version: 1.0\r\nCreated-By: Hymo Signer\r\nSHA1-Digest-Manifest: "
    sf_content += base64.b64encode(sha1_digest(full_manifest.encode('utf-8'))).decode('utf-8') + "\r\n\r\n"
    
    for entry in manifest_entries.split("\r\n\r\n"):
        if not entry.strip(): continue
        name_line = entry.split("\r\n")[0]
        
        entry_bytes = (entry + "\r\n\r\n").encode('utf-8')
        digest = base64.b64encode(sha1_digest(entry_bytes)).decode('utf-8')
        sf_content += name_line + "\r\nSHA1-Digest: " + digest + "\r\n\r\n"

    # 3. Create PKCS7 Block
    options = [pkcs7.PKCS7Options.DetachedSignature]
    builder = pkcs7.PKCS7SignatureBuilder().set_data(sf_content.encode('utf-8'))
    builder = builder.add_signer(cert, private_key, hashes.SHA256())
    pkcs7_blob = builder.sign(serialization.Encoding.DER, options)

    # 4. Write Output Zip
    with zipfile.ZipFile(input_zip, "r") as zin, zipfile.ZipFile(output_zip, "w") as zout:
        for item in zin.infolist():
            zout.writestr(item, zin.read(item.filename))
        
        zout.writestr("META-INF/MANIFEST.MF", full_manifest)
        zout.writestr("META-INF/CERT.SF", sf_content)
        zout.writestr("META-INF/CERT.EC", pkcs7_blob)

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 sign_zip.py <input_zip> <output_zip> <key_pem> <cert_pem>")
        sys.exit(1)
    
    sign_zip(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
