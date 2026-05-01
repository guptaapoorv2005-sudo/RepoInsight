import {redis} from "../lib/redis.js";

const fn = async () => {
    await redis.set("test", "hello");
    console.log(await redis.get("test"));
}

fn();