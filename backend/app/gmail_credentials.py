"""Fail closed without a supported OS credential vault; no plaintext fallback."""

import hashlib
import json

import keyring

from app.gmail_provider import GmailError


class CredentialVault:
    def __init__(self, database_path):
        self.service = (
            "FinanceTracker.Gmail." + hashlib.sha256(str(database_path).encode()).hexdigest()
        )

    def backend(self):
        backend = keyring.get_keyring()
        allowed = {
            ("keyring.backends.Windows", "WinVaultKeyring"),
            ("keyring.backends.macOS", "Keyring"),
            ("keyring.backends.SecretService", "Keyring"),
        }
        if (type(backend).__module__, type(backend).__name__) not in allowed:
            raise GmailError("SECURE_CREDENTIAL_STORE_UNAVAILABLE")
        return backend

    def get(self):
        try:
            value = self.backend().get_password(self.service, "connection")
            return json.loads(value) if value else None
        except Exception:
            raise GmailError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None

    def save(self, value):
        try:
            self.backend().set_password(self.service, "connection", json.dumps(value))
        except Exception:
            raise GmailError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None

    def delete(self):
        try:
            backend = self.backend()
            if backend.get_password(self.service, "connection") is not None:
                backend.delete_password(self.service, "connection")
        except Exception:
            raise GmailError("SECURE_CREDENTIAL_STORE_UNAVAILABLE") from None
