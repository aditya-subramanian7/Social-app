import { useSession } from "next-auth/react";
import {
  FormEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./Button";
import ProfileImage from "./ProfileImage";
import { api } from "~/utils/api";

export interface INewTweetFormProps {}

function updateTextAreaSize(textarea?: HTMLTextAreaElement) {
  if (!textarea) return;

  textarea.style.height = "0";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function Form() {
  const session = useSession();
  const [inputValue, setInputValue] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>();

  const inputRef = useCallback((textArea: HTMLTextAreaElement) => {
    updateTextAreaSize(textArea);
    textAreaRef.current = textArea;
  }, []);

  useLayoutEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [inputValue]);

  const trpcUtils = api.useContext();
  const createTweet = api.tweet.create.useMutation({
    onSuccess: (newTweet) => {
      setInputValue("");

      if (session.status !== "authenticated") return;
      trpcUtils.tweet.infiniteFeed.setInfiniteData({}, (oldData) => {
        if (oldData == null || oldData.pages[0] == null) return;
        const newCacheTweet = {
          ...newTweet,
          likeCount: 0,
          likedByMe: false,
          user: {
            id: session.data.user.id,
            name: session.data.user.name,
            image: session.data.user.image,
          },
        };

        return {
          ...oldData,
          pages: [
            {
              ...oldData.pages[0],
              tweets: [newCacheTweet, ...oldData.pages[0].tweets],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
    },
  });

  if (session.status !== "authenticated") return null;

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        createTweet.mutate({ content: inputValue });
      }}
      className="flex flex-col gap-2 border-b px-4 py-2"
    >
      <div className="flex gap-4 ">
        <ProfileImage src={session.data.user.image} />
        <textarea
          style={{ height: 0 }}
          className="flex-grow resize-none overflow-hidden p-4 text-lg outline-none"
          placeholder="Tweet Something"
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          ref={textAreaRef}
        />
      </div>
      <Button className=" self-end">Publish</Button>
    </form>
  );
}

export default function NewTweetForm() {
  const session = useSession();
  if (session.status !== "authenticated") return null;

  return <Form />;
}
