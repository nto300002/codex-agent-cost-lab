export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}

export class FixedClock implements Clock {
  readonly #fixedTime: number;

  constructor(fixedAt: Date | string) {
    const timestamp = new Date(fixedAt).getTime();
    if (Number.isNaN(timestamp)) {
      throw new RangeError("FixedClock requires a valid date.");
    }

    this.#fixedTime = timestamp;
  }

  now() {
    return new Date(this.#fixedTime);
  }
}
