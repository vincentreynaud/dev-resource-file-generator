"use strict";

const fs = require("fs");
const pdf = require("pdf-parse");
const path = require("path");

const {
  asyncForEach,
  linkPosition,
  hasStringTag,
  findLinkByLine,
  cutPageNumbering,
  isIncomplete,
  lastItem,
} = require("./helpers");

const crawl = async (dirpath, rank, options) => {
  const route = dirpath.split("/");
  const section = {};
  section.title = lastItem(route);
  section.rank = rank;
  section.links = [];
  section.subDirs = [];
  section.noLink = [];
  section.incompleteLink = [];

  if (section.rank === options.depth + 2) return section;
  if (options.description) section.description = options.description;

  console.log(`Browsing ${section.title}`);

  const files = fs.readdirSync(dirpath);
  await asyncForEach(files, async (file) => {
    const filePath = path.join(dirpath, file);

    if (fs.statSync(filePath).isDirectory()) {
      section.subDirs.push(filePath);
    }

    let wFileStr = null,
      dFileStr = null,
      buffer = null,
      link = null;

    switch (path.extname(filePath)) {
      case ".webloc":
        wFileStr = fs.readFileSync(filePath, { encoding: "utf8" });

        if (linkPosition(wFileStr) !== -1 && hasStringTag(wFileStr)) {
          link = wFileStr.split("<string>")[1].split("</string>")[0];
          section.links.push(link);
        } else if (linkPosition(wFileStr) !== -1) {
          const slice = wFileStr.slice(linkPosition(wFileStr));
          link = slice.split("\b")[0];
          section.links.push(link);
        } else {
          console.log(`NO LINK FOUND in: ${file}`);
        }
        break;
      case ".html":
        wFileStr = fs.readFileSync(filePath, { encoding: "utf8" });
        const regex = /href="http.*?"/gm;
        if (linkPosition(wFileStr) !== -1 && hasStringTag(wFileStr)) {
          link = wFileStr.match(regex);
          link = link.map((link) =>
            link.replace('href="', "").replace('"', "")
          );
          link.forEach((link) => section.links.push(link));
        } else if (linkPosition(wFileStr) !== -1) {
          link = wFileStr.match(regex);
          link = link.map((link) =>
            link.replace('href="', "").replace('"', "")
          );
          link.forEach((link) => section.links.push(link));
        } else {
          console.log(`NO LINK FOUND in: ${file}`);
        }
        break;

      case ".desktop":
        dFileStr = fs.readFileSync(filePath, { encoding: "utf8" });

        if (linkPosition(dFileStr) !== -1) {
          const slice = dFileStr.slice(linkPosition(dFileStr));
          link = slice.split("\n")[0];
          section.links.push(link);
        } else {
          console.log(`NO LINK FOUND in: ${file}`);
        }
        break;

      case ".pdf":
        buffer = fs.readFileSync(filePath);

        await pdf(buffer).then((data) => {
          const dataByLine = data.text.split("\n");
          link = findLinkByLine(dataByLine);

          if (link === null) {
            console.log(`NO LINK FOUND in: ${file}`);
            section.noLink.push(file);
            return;
          } else if (isIncomplete(link)) {
            console.log(`INCOMPLETE LINK in: ${file}`);
            section.incompleteLink.push(file);
            return;
          }

          link = cutPageNumbering(link);
          section.links.push(link);
        });
        break;
    }
  });

  // console.log("section", section.links);
  return section;
};

module.exports = crawl;
