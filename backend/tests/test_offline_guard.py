import os
import socket
import unittest


@unittest.skipUnless(os.environ.get('WORLDRAFT_OFFLINE_TESTS') == '1', 'Use npm run test:offline')
class OfflineGuardTests(unittest.TestCase):
    def test_external_dns_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, 'blocked external host'):
            socket.getaddrinfo('example.invalid', 443)

    def test_external_socket_is_blocked(self):
        with socket.socket() as connection:
            with self.assertRaisesRegex(RuntimeError, 'blocked external host'):
                connection.connect(('203.0.113.1', 443))
