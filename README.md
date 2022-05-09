# staticbuild

<div align="center">
  <img src="logo.png" width="420" alt="Bricks" >
  <br><br>
  A static site generator that isn't for you!
  <br><br>
</div>

`staticbuild` is a static site generator with minimum dependencies and minimum support for anything other than my own projects.

I'm currently using this in the following projects:

- [anthonyec/website](https://github.com/anthonyec/website)
- [anthonyec/archive](https://github.com/anthonyec/archive)

## Why

I used to use `jekyll` for generating [my website](https://anthonycossins.com/). But after switching to a new computer (M1 Macbook), I found it very difficult to setup Ruby, Bundler and all the other junk that was required to get my site running.

So out of frustration I built my own static site generator within a couple of hours. It was messy but it worked. And was actually faster than `jekyll` because I don't need it to be as flexible.

This version of `staticbuild` is an attempt to clean things up and document while still maintaining it's minimalism-ish.

## Usage

### Building a site

```sh
staticbuild <inputDirectory> <outputDirectory> [--watch]
```

### Viewing the site

There isn't a built-in way to serve the website generated by `staticbuild`. Use a separate HTTP server to view the site locally. I like using [`http-server`](https://www.npmjs.com/package/http-server).

```sh
npx http-server -c-1 ./dist -p 8081
```

## Docs

You wish.
