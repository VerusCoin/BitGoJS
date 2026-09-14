/* global describe, it */

var assert = require('assert')
var ECPair = require('../../../src/ecpair')

const {
  IdentitySignature,
  networks
} = require('../../../src')

describe('VerusID Signer and Verifier (verustest)', function () {
  var network = networks['verustest']
  const keyPair = ECPair.fromWIF('UrEJQMk9PD4Fo9i8FNb1ZSFRrC9TrD4j6CGbFvbFHVH83bStroHH', network)

  it('Sign and verify message with VerusID version 1 signatures', function () {
    const version = 1
    const hashType = 1
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)
    sig.signMessageOffline(msg, keyPair)
    const verificationResult = sig.verifyMessageOffline(msg, keyPair.getAddress())[0]

    assert.equal(
      sig.toBuffer().toString('base64'),
      'AfdGAAABQSDLWEju39WoEBsEmkzWLIoCjvGUhDkom/exPHNytst+vnYgBy7+z+eUOV5jFr5atSUkADYST7V2Ji0nxrg8C0Vv'
    )
    assert.equal(verificationResult, true)
  })

  it('Sign and verify hash with VerusID version 1 signatures', function () {
    const version = 1
    const hashType = 1
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)

    const hash = sig.hashMessage('signedmessage')

    sig.signHashOffline(hash, keyPair)
    const verificationResult = sig.verifyHashOffline(hash, keyPair.getAddress())[0]

    assert.equal(
      sig.toBuffer().toString('base64'),
      'AfdGAAABQSDLWEju39WoEBsEmkzWLIoCjvGUhDkom/exPHNytst+vnYgBy7+z+eUOV5jFr5atSUkADYST7V2Ji0nxrg8C0Vv'
    )
    assert.equal(verificationResult, true)
  })

  it('Sign and verify longer hash with VerusID version 1 signatures', function () {
    const version = 1
    const hashType = 1
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)

    const hash = sig.hashMessage('signedmessagelongershouldtriggerlengtherrorsifwrittenincorrectly')

    sig.signHashOffline(hash, keyPair)
    const verificationResult = sig.verifyHashOffline(hash, keyPair.getAddress())[0]

    assert.equal(verificationResult, true)
  })

  it('Verify version 1 signature', function () {
    const sig = new IdentitySignature(network)
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'
    const wrongmsg = 'notsignedmessage'

    sig.fromBuffer(
      Buffer.from(
        'AfdGAAABQSDLWEju39WoEBsEmkzWLIoCjvGUhDkom/exPHNytst+vnYgBy7+z+eUOV5jFr5atSUkADYST7V2Ji0nxrg8C0Vv',
        'base64'
      ),
      0,
      chainId,
      iAddress
    )

    assert.equal(
      sig.verifyMessageOffline(
        msg,
        keyPair.getAddress()
      )[0],
      true
    )
    assert.equal(
      sig.verifyMessageOffline(
        wrongmsg,
        keyPair.getAddress()
      )[0],
      false
    )
  })

  it('Sign and verify message with VerusID version 2 signatures', function () {
    const version = 2
    const hashType = 5
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)
    sig.signMessageOffline(msg, keyPair)
    const verificationResult = sig.verifyMessageOffline(msg, keyPair.getAddress())[0]

    assert.equal(
      sig.toBuffer().toString('base64'),
      'AgX3RgAAAUEgkH849JQVsiFEJeg33Zxdakm2Ty6aNthhq1aptFliLLtMJDV1AiQDEhiB0ikP4EJn7VzGI3ahPMs5DC2rJLfqaQ=='
    )
    assert.equal(verificationResult, true)
  })

  it('Sign and verify hash with VerusID version 2 signatures', function () {
    const version = 2
    const hashType = 5
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)

    const hash = sig.hashMessage('signedmessage')

    sig.signHashOffline(hash, keyPair)
    const verificationResult = sig.verifyHashOffline(hash, keyPair.getAddress())[0]

    assert.equal(
      sig.toBuffer().toString('base64'),
      'AgX3RgAAAUEgkH849JQVsiFEJeg33Zxdakm2Ty6aNthhq1aptFliLLtMJDV1AiQDEhiB0ikP4EJn7VzGI3ahPMs5DC2rJLfqaQ=='
    )
    assert.equal(verificationResult, true)
  })

  it('Sign and verify longer hash with VerusID version 2 signatures', function () {
    const version = 2
    const hashType = 5
    const blockHeight = 18167
    const signatures = null
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'

    const sig = new IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress)

    const hash = sig.hashMessage('signedmessagelongershouldtriggerlengtherrorsifwrittenincorrectly')

    sig.signHashOffline(hash, keyPair)
    const verificationResult = sig.verifyHashOffline(hash, keyPair.getAddress())[0]

    assert.equal(verificationResult, true)
  })

  it('Verify version 2 signature', function () {
    const sig = new IdentitySignature(network)
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'
    const wrongmsg = 'notsignedmessage'

    sig.fromBuffer(
      Buffer.from(
        'AgX3RgAAAUEgkH849JQVsiFEJeg33Zxdakm2Ty6aNthhq1aptFliLLtMJDV1AiQDEhiB0ikP4EJn7VzGI3ahPMs5DC2rJLfqaQ==',
        'base64'
      ),
      0,
      chainId,
      iAddress
    )

    assert.equal(
      sig.verifyMessageOffline(
        msg,
        keyPair.getAddress()
      )[0],
      true
    )
    assert.equal(
      sig.verifyMessageOffline(
        wrongmsg,
        keyPair.getAddress()
      )[0],
      false
    )
  })

  // Existing compressed fixtures with only the compact header's compression bit cleared.
  const uncompressedFixtures = [
    {
      version: 1,
      hashType: 1,
      signature: 'AfdGAAABQRzLWEju39WoEBsEmkzWLIoCjvGUhDkom/exPHNytst+vnYgBy7+z+eUOV5jFr5atSUkADYST7V2Ji0nxrg8C0Vv'
    },
    {
      version: 2,
      hashType: 5,
      signature: 'AgX3RgAAAUEckH849JQVsiFEJeg33Zxdakm2Ty6aNthhq1aptFliLLtMJDV1AiQDEhiB0ikP4EJn7VzGI3ahPMs5DC2rJLfqaQ=='
    }
  ]

  uncompressedFixtures.forEach(function (fixture) {
    const uncompressedWIF = '7Jx87en7tFWjmtpP2u1ugyUHWGfczNK4eRkruKV9g5bTyRQx1Eh'
    const signingAddress = 'RSpiCyqRDCF7pijGgx7hJ7AfT5pk1PSJgj'
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'

    it('Sign version ' + fixture.version + ' signature with an imported uncompressed WIF', function () {
      const uncompressedKeyPair = ECPair.fromWIF(uncompressedWIF, network)
      const sig = new IdentitySignature(network, fixture.version, fixture.hashType, 18167, null, chainId, iAddress)

      assert.strictEqual(uncompressedKeyPair.compressed, false)
      assert.strictEqual(uncompressedKeyPair.getAddress(), signingAddress)
      sig.signMessageOffline(msg, uncompressedKeyPair)

      assert.strictEqual(sig.toBuffer().toString('base64'), fixture.signature)
      assert.deepStrictEqual(sig.verifyMessageOffline(msg, signingAddress), [true])
    })

    it('Verify version ' + fixture.version + ' uncompressed signature fixture', function () {
      const sig = new IdentitySignature(network)
      sig.fromBuffer(Buffer.from(fixture.signature, 'base64'), 0, chainId, iAddress)

      assert.deepStrictEqual(sig.verifyMessageOffline(msg, signingAddress), [true])
      assert.deepStrictEqual(sig.verifyMessageOffline('notsignedmessage', signingAddress), [false])
      assert.deepStrictEqual(sig.verifyMessageOffline(msg, keyPair.getAddress()), [false])
    })
  })

  it('Reject signature with incorrect recid', function () {
    const sig = new IdentitySignature(network)
    const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    const iAddress = 'i8jHXEEYEQ7KEoYe6eKXBib8cUBZ6vjWSd'
    const msg = 'signedmessage'

    sig.fromBuffer(
      Buffer.from(
        'AfdGAAABQR/LWEju39WoEBsEmkzWLIoCjvGUhDkom/exPHNytst+vnYgBy7+z+eUOV5jFr5atSUkADYST7V2Ji0nxrg8C0Vv',
        'base64'
      ),
      0,
      chainId,
      iAddress
    )

    assert.equal(
      sig.verifyMessageOffline(
        msg,
        keyPair.getAddress()
      )[0],
      false
    )
  })
})
