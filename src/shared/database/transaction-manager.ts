export interface TransactionManager<TTransaction> {
  run<TResult>(
    operation: (transaction: TTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}
