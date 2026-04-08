import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

def b64url(data):
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

priv = ec.generate_private_key(ec.SECP256R1(), default_backend())
pub = priv.public_key()

priv_bytes = priv.private_numbers().private_value.to_bytes(32, 'big')
pub_bytes = pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)

with open('.env', 'a') as f:
    f.write(f"\nVAPID_PRIVATE_KEY={b64url(priv_bytes)}\n")
    f.write(f"VAPID_PUBLIC_KEY={b64url(pub_bytes)}\n")
    f.write("VAPID_SUBJECT=mailto:admin@example.com\n")

print("VAPID keys added to .env")
