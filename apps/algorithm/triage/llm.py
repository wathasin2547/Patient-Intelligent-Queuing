"""Free text -> symptomCode[] via the LLM (SPEC.md §4). Added in phase 5.

The LLM only maps text to codes. It must not choose a department, a priority or a disease.
Every returned code is filtered against the catalog before use.
"""
