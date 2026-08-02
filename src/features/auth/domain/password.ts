import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const algorithm = "scrypt";
const version = "v1";
const keyLength = 64;
const parameters = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const satisfies ScryptOptions;

function deriveKey(
  password: string,
  salt: Buffer,
  options: ScryptOptions = parameters,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function isHex(value: string) {
  return (
    value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value)
  );
}

export async function hashPassword(
  password: string,
  salt = randomBytes(16),
): Promise<string> {
  const derivedKey = await deriveKey(password, salt);

  return [
    algorithm,
    version,
    parameters.N,
    parameters.r,
    parameters.p,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.split("$");
  if (parts.length !== 7) {
    return false;
  }

  const [storedAlgorithm, storedVersion, n, r, p, saltHex, hashHex] = parts;
  const parsedParameters = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: parameters.maxmem,
  };

  if (
    storedAlgorithm !== algorithm ||
    storedVersion !== version ||
    parsedParameters.N !== parameters.N ||
    parsedParameters.r !== parameters.r ||
    parsedParameters.p !== parameters.p ||
    !isHex(saltHex) ||
    !isHex(hashHex)
  ) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== keyLength) {
    return false;
  }

  const actual = await deriveKey(
    password,
    Buffer.from(saltHex, "hex"),
    parsedParameters,
  );

  return timingSafeEqual(actual, expected);
}
