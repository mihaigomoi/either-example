import { Either, right, left, merge } from '@sweet-monads/either';
import { ErrorMessageOptions, safeParse } from 'zod-error';
import z from 'zod/lib';
import * as R from 'ramda';

type Message = {
  code: 200 | 400;
  message: string;
};
enum Mode {
  Flush = 'Flush',
  NoFlush = 'NoFlush',
  Rollback = 'Rollback',
}
const PayloadSchema = z.object({
  feedId: z.string().min(1),
  mode: z.nativeEnum(Mode),
});
type Payload = z.infer<typeof PayloadSchema>;

function timeout(ms) {
  //console.log('... waiting ...');
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const feedInProgress = true;

function getParsed(body: string): Either<Message, Payload> {
  console.log('getParsed: ', body);
  const parsedPayload = safeParse(PayloadSchema, JSON.parse(body || ''));
  if (parsedPayload.success === false) {
    return left({ code: 400, ...parsedPayload.error });
  }
  return right(parsedPayload.data);
}

async function feedExist(
  db: string,
  payload: Payload
): Promise<Either<Message, Payload>> {
  console.log('feedExist', payload);
  await timeout(1000);
  if (payload.feedId !== '1') {
    return left({
      code: 400,
      message: `Feed with id ${payload.feedId} does not exist`,
    });
  }
  return right(payload);
}

async function isFeedInProgress(
  db: string,
  payload: Payload
): Promise<Either<Message, Payload>> {
  console.log('isFeedInProgress', payload);
  await timeout(1000);
  if (feedInProgress) {
    return left({
      code: 400,
      message: `Feed with id ${payload.feedId} has assets in progress`,
    });
  }
  return right(payload);
}

async function closeFeed(
  db: string,
  payload: Payload
): Promise<Either<Message, Message>> {
  console.log('closeFeed', payload);
  await timeout(1000);
  return right({
    code: 200,
    message: `Feed with id ${payload.feedId} is closed`,
  });
}

// continue pipe invocation while Right, break on first Left
// knows how to deal with promises
var pipeWhileRightP = R.pipeWith((fun, previousResult) => {
  if (previousResult && previousResult.then) {
    return previousResult.then((resultP) => {
      return resultP.isRight() ? fun(resultP.value) : resultP;
    });
  } else {
    return previousResult.isRight()
      ? fun(previousResult.value)
      : previousResult;
  }
});

(async () => {
  let db = 'this is my database';
  let payload = '{"feedId": "2", "mode":"Flush"}';
  var response = await pipeWhileRightP([
    getParsed,
    R.curry(feedExist)(db),
    R.curry(isFeedInProgress)(db),
    R.curry(closeFeed)(db),
  ])(payload);

  console.log('!!!', response.value);
})();
