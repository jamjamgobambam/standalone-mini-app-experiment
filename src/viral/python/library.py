"""
Viral library — standalone prototype version.

Unlike the other mini-apps, ``viral`` does not require students to
import anything. The visualization listens directly to stdout: any
line matching the format

    Day <day>: <views> views

is parsed and used to update the network. Numbers may include commas
or underscores (Python's ``1_000_000`` literal style). For example:

    Day 0: 150 views
    Day 12: 19,403 views
    Day 33: 5,000,000,000 views

So a student's ``simulate`` function is just a plain Python loop:

    def simulate(start, virality, days):
        views = start
        for day in range(days + 1):
            views += round(views * virality)
            print(f"Day {day}: {views:,} views")
        return views

    simulate(1, 1.0, 33)

This file is still loaded so that ``from viral import ...`` does not
error if a student tries it, but it exposes nothing.
"""
