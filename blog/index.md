---
layout: default
title: "blog &lt; caryoscelus"
---

<h2>Blog</h2>
<div id="home">
  <ul class="posts">
    {% for post in site.posts %}
      <li>
        <div class="meta">{{ post.date | date_to_string }}</div>
        <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
        {{ post.content | split: '<cut />' | first }}
        <p class="read_more"><a href="{{ post.url }}">Read more..</a></p>
      </li>
    {% endfor %}
  </ul>
</div>
