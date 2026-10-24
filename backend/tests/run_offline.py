"""Run deterministic unit tests with internet access rejected in-process."""
import os
from pathlib import Path
import socket
import unittest

os.environ['WORLDRAFT_OFFLINE_TESTS'] = '1'
os.environ['LANGSMITH_TRACING'] = 'false'
os.environ['LANGCHAIN_TRACING_V2'] = 'false'


def assert_local(host):
    if host is not None and host not in ('localhost', '127.0.0.1', '::1', b'localhost', b'127.0.0.1', b'::1'):
        raise RuntimeError(f'Offline unit test blocked external host: {host}')


original_connect = socket.socket.connect
original_connect_ex = socket.socket.connect_ex
original_getaddrinfo = socket.getaddrinfo


def local_connect(self, address):
    if isinstance(address, tuple):
        assert_local(address[0])
    return original_connect(self, address)


def local_connect_ex(self, address):
    if isinstance(address, tuple):
        assert_local(address[0])
    return original_connect_ex(self, address)


def local_getaddrinfo(host, *args, **kwargs):
    assert_local(host)
    return original_getaddrinfo(host, *args, **kwargs)


socket.socket.connect = local_connect
socket.socket.connect_ex = local_connect_ex
socket.getaddrinfo = local_getaddrinfo
suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent))
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
